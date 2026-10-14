# TTRPG Cluster Control UI prototype

This disposable prototype compares three layouts over the same seeded Jump Cluster and star-system maps. Opening `/` loads the accepted B direction by default. Use `?variant=A` or `?variant=C` to compare the other layouts, or `?variant=baseline` to open the existing baseline application. The development-only switcher changes the prototype query string, and its Share button copies the current variant URL.

The B interface is a preview backed by seeded in-memory data. Its inspector states that no workspace storage is connected; edits reset when the page reloads. It does not read or change the saved IndexedDB workspace. The baseline application remains available at `/?variant=baseline`.

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

Variant B keeps its tool rail and map-first layout. At phone widths (up to 760 px), and in short landscape viewports up to 1024 px wide, the inspector covers the full viewport and scrolls internally; the map returns in the same view when the inspector is hidden. The Hide control stays available in the sticky inspector heading, and the tool rail stays above the panel so users can switch to Hierarchy. Only one of Inspector and Hierarchy can be open at a time in these responsive ranges. Switching panels keeps an unsaved inspector draft, while a hierarchy selection still passes through the Apply, Discard, or Stay guard before it opens the inspector. Wider desktop layouts keep the panels non-modal and allow both to remain open; if both are open when the viewport becomes phone-sized, the last panel opened stays visible. The catalogue picker groups the existing addable mark types by family and opens from Add mark on the tool rail. Selecting an existing map item remains a separate action.

The Hierarchy control is closed by default. When opened, it shows the cluster and routes or the active system's actual nested Orbit and map-mark hierarchy, including hosted Orbit children. It is separate from the catalogue picker and uses the current selection. Selection changes still pass through the inspector's Apply, Discard, or Stay guard.

The field-definition dialog is the existing editor connected to this prototype's in-memory workspace. It exposes the two native single-select fields and custom text, number, boolean, and single-select definitions; edits names, options, and applicability; lists assignments; previews assignments cleared by removed options or deleted definitions; and requires explicit confirmation before those values are cleared. A conflicting inspector draft has its own Apply, Discard, or Stay step. Applicability changes only affect where a field is shown; existing values are retained. Definition mutations advance the prototype's simulated save state. These paths edit only the seeded in-memory sample and do not write a product database or browser storage.

This is representative UI coverage for design review, not a claim that every production field workflow or platform behavior is implemented. In particular, it does not exercise multi-user data, persistence, or every touch and virtual-keyboard combination.

## Prototype-only behavior

There is no IndexedDB write, backend, account, sync, or durable workspace state in these variants. The seed, edits, route and field changes, import candidate, and confirmed deletions are held in memory and reset on reload. Apply updates the sample; its simulated save deliberately fails once and then succeeds when Retry is pressed. Import uses the existing JSON preparation helper for a preview, but does not replace a saved workspace. The delete dialog applies the domain deletion plan to the sample only.

SVG and PNG exports are real downloads from the currently applied in-memory map. They use a print-light palette; unapplied inspector edits and an in-progress map gesture are excluded. Applied sample edits remain exportable even when the simulated save indicator is in its error state. Theme and map view state are session-local. No browser storage is used for the prototype preference.

This prototype is for choosing an interaction and layout direction. It does not establish product guarantees for offline behavior, persistence, mobile touch gestures, accessibility conformance, performance, or server rendering. It has not been measured against production workload or device coverage.

## Validation

`npm run typecheck` passed after this refinement. `npm run build` passed on the preceding prototype revision at `fa696eaf`; this narrow UI change was not rebuilt.

Earlier Chrome checks covered the B hierarchy through depth 4; native and custom assignment lists; native-option impact preview, cancel, and confirmation; custom-field rename and deletion preview, cancel, and confirmation; and a follow-up object Apply that did not restore removed values. The field-conflict guard was reachable inside the native field dialog; applying the object draft refreshed the impact list, and canceling the refreshed review preserved the assignment.

The latest responsive Chrome check measured the open inspector at `(0, 0, 390, 844)`, `(0, 0, 390, 500)`, and `(0, 0, 844, 390)`. On each viewport, switching between Details and Hierarchy through the tool rail left exactly one panel open and preserved the dirty inspector draft `Gannet draft proof`; the rail remained clickable above the development variant switcher. At 1440 px desktop width, both panels could stay open, and resizing to 390 px left the most recently opened Hierarchy visible. The removed map utility strip and LIVE MAP badge were absent, and the checked paths produced no JavaScript errors. Captures are `../visuals/B-fullheight-phone.png`, `../visuals/B-fullheight-short-phone.png`, and `../visuals/B-fullheight-landscape.png`. These are manual checks of exercised prototype paths, not full device or production coverage.
