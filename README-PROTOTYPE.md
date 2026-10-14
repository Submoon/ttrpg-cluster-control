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

## Feedback revision

Variant B keeps its tool rail and map-first layout while combining two requested interactions: on a narrow viewport, the inspector becomes a full-width bottom sheet with bounded scrolling, and the map remains navigable above it; on wider screens, the inspector stays beside the map. Hiding the inspector preserves its draft and leaves a small reopen control. The catalogue picker groups the existing addable mark types by family. It starts an Add action; selecting an existing map item remains a separate action.

The Hierarchy control is closed by default. When opened, it shows the cluster and routes or the active system's actual nested Orbit and map-mark hierarchy, including hosted Orbit children. It is separate from the catalogue picker and uses the current selection. Selection changes still pass through the inspector's Apply, Discard, or Stay guard.

The field-definition dialog is the existing editor connected to this prototype's in-memory workspace. It exposes the two native single-select fields and custom text, number, boolean, and single-select definitions; edits names, options, and applicability; lists assignments; previews assignments cleared by removed options or deleted definitions; and requires explicit confirmation before those values are cleared. A conflicting inspector draft has its own Apply, Discard, or Stay step. Applicability changes only affect where a field is shown; existing values are retained. Definition mutations advance the prototype's simulated save state. These paths edit only the seeded in-memory sample and do not write a product database or browser storage.

This is representative UI coverage for design review, not a claim that every production field workflow or platform behavior is implemented. In particular, it does not exercise multi-user data, persistence, or every touch and virtual-keyboard combination.

## Prototype-only behavior

There is no IndexedDB write, backend, account, sync, or durable workspace state in these variants. The seed, edits, route and field changes, import candidate, and confirmed deletions are held in memory and reset on reload. Apply updates the sample; its simulated save deliberately fails once and then succeeds when Retry is pressed. Import uses the existing JSON preparation helper for a preview, but does not replace a saved workspace. The delete dialog applies the domain deletion plan to the sample only.

SVG and PNG exports are real downloads from the currently applied in-memory map. They use a print-light palette; unapplied inspector edits and an in-progress map gesture are excluded. Applied sample edits remain exportable even when the simulated save indicator is in its error state. Theme and map view state are session-local. No browser storage is used for the prototype preference.

This prototype is for choosing an interaction and layout direction. It does not establish product guarantees for offline behavior, persistence, mobile touch gestures, accessibility conformance, performance, or server rendering. It has not been measured against production workload or device coverage.

## Validation

`npm run typecheck` passed. `npm run build` passed after Nitro's initial sandboxed attempt hit a `realpath` permission error on `vue-router`; the authorized retry completed the client, server, and Nitro bundles.

The Chrome check covered the B hierarchy through depth 4; native and custom assignment lists; native-option impact preview, cancel, and confirmation; custom-field rename and deletion preview, cancel, and confirmation; and a follow-up object Apply that did not restore removed values. The field-conflict guard was reachable inside the native field dialog; applying the object draft refreshed the impact list, and canceling the refreshed review preserved the assignment. At 390 px wide, the inspector filled the bottom width, the hierarchy close control remained reachable, and the tool rail scrolled with Navigate and Details still clickable. The catalogue picker stayed compact with the map visible; choosing Planet and clicking a map target placed the mark and returned to Navigation. The phone and short-landscape checks recorded no JavaScript errors or horizontal document overflow. These are manual checks of the exercised prototype paths, not full device or production coverage.
