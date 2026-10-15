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

Variant B keeps its tool rail and map-first layout. At phone widths (up to 760 px), and in short landscape viewports up to 1024 px wide, Inspector and Hierarchy each cover the full viewport and scroll internally. Each has its own close control; the tool rail and zoom controls stay hidden until the panel closes. The single Inspect control remains on the rail, which sits at the viewport's safe-area edge in map mode and clears the development-only variant switcher when it is present. A system map keeps a visible return to the Jump Cluster. Only one of Inspector and Hierarchy can be open at a time in these responsive ranges. Switching panels keeps an unsaved inspector draft, while a hierarchy selection still passes through the Apply, Discard, or Stay guard before it opens the inspector. Wider desktop layouts keep the panels non-modal and allow both to remain open; if both are open when the viewport becomes phone-sized, the last panel opened stays visible. The catalogue picker groups the existing addable mark types by family and opens from Add mark on the tool rail. Selecting an existing map item remains a separate action.

The Hierarchy control is closed by default. When opened, it shows the cluster and routes or the active system's actual nested Orbit and map-mark hierarchy, including hosted Orbit children. It is separate from the catalogue picker and uses the current selection. Selection changes still pass through the inspector's Apply, Discard, or Stay guard.

The field-definition dialog is the existing editor connected to this prototype's in-memory workspace. It exposes the two native single-select fields and custom text, number, boolean, and single-select definitions; edits names, options, and applicability; lists assignments; previews assignments cleared by removed options or deleted definitions; and requires explicit confirmation before those values are cleared. A conflicting inspector draft has its own Apply, Discard, or Stay step. Applicability changes only affect where a field is shown; existing values are retained. Definition mutations advance the prototype's simulated save state. These paths edit only the seeded in-memory sample and do not write a product database or browser storage.

This is representative UI coverage for design review, not a claim that every production field workflow or platform behavior is implemented. In particular, it does not exercise multi-user data, persistence, or every touch and virtual-keyboard combination.

On 2026-10-15, the phone-feedback revision was checked in a local production build and headless Chrome with Playwright mobile/touch emulation at 390×844 and 844×390. All eight rail controls, including Inspect, and all three zoom controls were within the viewport and passed center-point hit tests. The cluster node's accessible label followed Navigation versus Move, Navigate opened the system map without opening Inspector, Back remained reachable, and the discard toast did not overlap or block zoom. This is viewport-emulated browser coverage, not physical-device validation. The reproduction script and results are in `.scratch/interface-revamp/device-preservation-lab/qa-corrective-geometry.mjs` and `.scratch/interface-revamp/device-preservation-lab/artifacts/corrective-2026-10-15/`.

The 2026-10-15 seed-fixture correction converts the Vela Reach and Kestrel Deep free-Orbit center scene points to normalized points when `seedWorkspace()` creates those sample records. This is an explicit fixture correction, not runtime normalization or a migration of existing workspace data. Astra reproduced the Fit failure on published commit `4d90f9774ea14b49fe6f99f1c72becacfd8454ed`; the phone-feedback build and its screenshots above predate this correction and do not verify Fit afterward. The corrected source has passed typecheck, while Fit validation awaits Astra's check of the published corrected preview.

## Prototype-only behavior

There is no IndexedDB write, backend, account, sync, or durable workspace state in these variants. The seed, edits, route and field changes, import candidate, and confirmed deletions are held in memory and reset on reload. Apply updates the sample; its simulated save deliberately fails once and then succeeds when Retry is pressed. Import uses the existing JSON preparation helper for a preview, but does not replace a saved workspace. The delete dialog applies the domain deletion plan to the sample only.

SVG and PNG exports are real downloads from the currently applied in-memory map. They use a print-light palette; unapplied inspector edits and an in-progress map gesture are excluded. Applied sample edits remain exportable even when the simulated save indicator is in its error state. Theme and map view state are session-local. No browser storage is used for the prototype preference.

This prototype is for choosing an interaction and layout direction. It does not establish product guarantees for offline behavior, persistence, mobile touch gestures, accessibility conformance, performance, or server rendering. It has not been measured against production workload or device coverage.

## Validation

On 2026-10-15, `npm run build` and post-build `npm run typecheck` passed on an isolated production copy of the phone-feedback patch based on `99fe1a57`, before the Orbit seed-fixture correction described above. After the fixture correction, `npm run typecheck` passed on the isolated dependency runtime with the updated `PrototypeWorkbench.vue`. No new production build or local Fit browser run was performed for the two fixture values; Astra will check Fit on the published corrected preview. The earlier build and viewport checks are not evidence for this latest Fit correction.

Earlier Chrome checks covered the B hierarchy through depth 4; native and custom assignment lists; native-option impact preview, cancel, and confirmation; custom-field rename and deletion preview, cancel, and confirmation; and a follow-up object Apply that did not restore removed values. The field-conflict guard was reachable inside the native field dialog; applying the object draft refreshed the impact list, and canceling the refreshed review preserved the assignment.

The previous responsive Chrome check measured `(0, 0, 390, 844)`, `(0, 0, 390, 500)`, and `(0, 0, 844, 390)`, and covered panel exclusivity, draft retention, and desktop resizing. Those observations predate the current changes. The current focused checks above cover 390×844 and 844×390; 390×500 and the complete earlier preservation matrix have not been repeated. The captures `../visuals/B-fullheight-phone.png`, `../visuals/B-fullheight-short-phone.png`, and `../visuals/B-fullheight-landscape.png` document the earlier layout only.
