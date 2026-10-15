# TTRPG Cluster Control UI prototype

This disposable prototype compares three layouts over the same seeded Jump Cluster and star-system maps. Opening `/` loads the accepted B direction by default. Use `?variant=A` or `?variant=C` to compare the other layouts, or `?variant=baseline` to open the existing baseline application. Variant B has two focused control-presentation candidates at `/?variant=B&controls=groups` and `/?variant=B&controls=dock`; `/` and `/?variant=B` default to the human-selected `dock`. The development-only switcher changes the prototype query string, and its Share button copies the current variant URL.

The B interface is a preview backed by seeded in-memory data. Its inspector states that no workspace storage is connected; edits reset when the page reloads. It does not read or change the saved IndexedDB workspace. The baseline application remains available at `/?variant=baseline`.

## Run

From the repository root, run:

```sh
npm run dev
```

Use the local development server for agent testing and iteration. Vercel is the human's mobile preview. To use the original fixed prototype port instead, run:

```sh
npm run prototype
```

The latter command listens on `http://127.0.0.1:3113`. Neither command builds or publishes the product. Use a separate owned port if another server is already running.

## What is connected

The prototype renders the existing D3/SVG cluster and system maps in a client-only canvas. Map pan/zoom, system opening, explicit return to the cluster, and map selection use those renderers. The three shells use the same in-memory workspace, selection, active tool, inspector draft, and theme; each shell owns its own map viewport instance. Variant B starts in Navigate, with Select and Move as modes and Add as a repeatable creation action. Successful Add placements keep the same type active; the user can choose another type or quit Add to return to Navigate. Variants A and C retain their existing prototype flow. The inspector can be hidden and reopened without dropping edits, and context changes offer Stay, Apply, and Discard.

Nuxt UI provides the shared buttons, fields, selects, badges, menus, and dialogs. The map canvas remains a targeted custom surface because the existing SVG map interactions and a non-modal inspector need to stay visible together. Prototype maps mount inside `ClientOnly` and `KeepAlive`; the baseline page remains a separate component and is not mounted when a prototype variant is selected.

## Feedback revision

Variant B keeps its map-first layout. At phone widths (up to 760 px), and in short landscape viewports up to 1024 px wide, Inspector and Hierarchy each cover the full viewport and scroll internally. Each has its own close control; mode controls and zoom stay hidden until the panel closes. A system map keeps a visible return to the Jump Cluster. Only one of Inspector and Hierarchy can be open at a time in these responsive ranges. Switching panels keeps an unsaved inspector draft, while a hierarchy selection still passes through the Apply, Discard, or Stay guard before it opens the inspector. Wider desktop layouts keep the panels non-modal and allow both to remain open; if both are open when the viewport becomes phone-sized, the last panel opened stays visible. The catalogue picker groups the existing addable mark types by family. Selecting an existing map item remains a separate action.

## Variant B controls

The human selected Dock after comparing two presentations of the same B modes, creation actions, panels and map-file commands. Groups remains available as a reference. The refined preview is ready for representative device feedback; it does not establish final product or library acceptance.

- `/?variant=B&controls=groups` retains the grouped Navigate, Select, Move and Add rail, with direct Import, PNG, SVG and Share commands. The shared panel commands now sit in map chrome.
- `/?variant=B&controls=dock` is the default. It places the three modes in a map dock, with Add beside them. Hierarchy and Inspect sit beside Map files in the map HUD; the command row wraps on narrow screens.

Add now uses a Nuxt UI Popover with the actual Add button as its trigger. Creation choices and the catalogue share that anchored surface; close, outside interaction and Escape preserve the selected tool/type. A map gesture used to dismiss the chooser is consumed without creating an object, and the next distinct activation works normally. Orbit placement converts the pointer through the SVG scene transform and uses existing ellipse geometry to preserve the chosen angle, including rotated and hosted Orbits. Keyboard activation uses an explicit local twelve-o'clock position rather than synthetic pointer coordinates. See the [Dock feedback report](.scratch/interface-revamp/research/dock-feedback-2026-10-15.md) for source provenance, review and executed validation.

The query switch and development switcher preserve the current in-memory map, mode, Add type, route origin, selection, and drafts. Both candidates keep a single zoom group and visible Back to Jump Cluster control. A right-button pan and two-contact pan navigate in every mode without placing or editing on release. Orbit manipulation handles expose their operation and target to assistive technology. The switcher does not resolve ticket 12's presentation decision.

The Hierarchy control is closed by default. When opened, it shows the cluster and routes or the active system's actual nested Orbit and map-mark hierarchy, including hosted Orbit children. It is separate from the catalogue picker and uses the current selection. Selection changes still pass through the inspector's Apply, Discard, or Stay guard.

The field-definition dialog is the existing editor connected to this prototype's in-memory workspace. It exposes the two native single-select fields and custom text, number, boolean, and single-select definitions; edits names, options, and applicability; lists assignments; previews assignments cleared by removed options or deleted definitions; and requires explicit confirmation before those values are cleared. A conflicting inspector draft has its own Apply, Discard, or Stay step. Applicability changes only affect where a field is shown; existing values are retained. Definition mutations advance the prototype's simulated save state. These paths edit only the seeded in-memory sample and do not write a product database or browser storage.

This is representative UI coverage for design review, not a claim that every production field workflow or platform behavior is implemented. In particular, it does not exercise multi-user data, persistence, or every touch and virtual-keyboard combination.

On 2026-10-15, the earlier phone-feedback revision was checked in a local production build and headless Chrome with Playwright mobile/touch emulation at 390×844 and 844×390. Its eight rail controls, including Inspect, and three zoom controls were within the viewport and passed center-point hit tests. Navigate opened the system map without opening Inspector, Back remained reachable, and the discard toast did not overlap or block zoom. This historical check covered the earlier rail; it does not validate the grouped or dock candidates documented below. It is viewport-emulated browser coverage, not physical-device validation. The reproduction script and results are in `.scratch/interface-revamp/device-preservation-lab/qa-corrective-geometry.mjs` and `.scratch/interface-revamp/device-preservation-lab/artifacts/corrective-2026-10-15/`.

The 2026-10-15 seed-fixture correction converts the Vela Reach and Kestrel Deep free-Orbit center scene points to normalized points when `seedWorkspace()` creates those sample records. This is an explicit fixture correction, not runtime normalization or a migration of existing workspace data. Astra reproduced the Fit failure on published commit `4d90f9774ea14b49fe6f99f1c72becacfd8454ed`; the phone-feedback build and its screenshots above predate this correction. The parent subsequently verified Fit for the corrected Vela and Kestrel samples in the published preview through the connected in-app browser. That confirms browser behavior, not physical-device behavior.

## Prototype-only behavior

There is no IndexedDB write, backend, account, sync, or durable workspace state in these variants. The seed, edits, route and field changes, import candidate, and confirmed deletions are held in memory and reset on reload. Apply updates the sample; its simulated save deliberately fails once and then succeeds when Retry is pressed. Import uses the existing JSON preparation helper for a preview, but does not replace a saved workspace. The delete dialog applies the domain deletion plan to the sample only.

SVG and PNG exports are real downloads from the currently applied in-memory map. They use a print-light palette; unapplied inspector edits and an in-progress map gesture are excluded. Applied sample edits remain exportable even when the simulated save indicator is in its error state. Theme and map view state are session-local. No browser storage is used for the prototype preference.

This prototype is for choosing an interaction and layout direction. It does not establish product guarantees for offline behavior, persistence, mobile touch gestures, accessibility conformance, performance, or server rendering. It has not been measured against production workload or device coverage.

## Validation

On 2026-10-15, `npm run build` and post-build `npm run typecheck` passed on an isolated production copy of the phone-feedback patch based on `99fe1a57`, before the Orbit seed-fixture correction described above. After the fixture correction, `npm run typecheck` passed on the isolated dependency runtime with the updated `PrototypeWorkbench.vue`. The parent later verified Fit for both corrected Orbit fixtures on the published preview through the connected in-app browser. The earlier build and viewport screenshots still predate that correction, and the browser check does not establish physical-device behavior.

Earlier Chrome checks covered the B hierarchy through depth 4; native and custom assignment lists; native-option impact preview, cancel, and confirmation; custom-field rename and deletion preview, cancel, and confirmation; and a follow-up object Apply that did not restore removed values. The field-conflict guard was reachable inside the native field dialog; applying the object draft refreshed the impact list, and canceling the refreshed review preserved the assignment.

The previous responsive Chrome check measured `(0, 0, 390, 844)`, `(0, 0, 390, 500)`, and `(0, 0, 844, 390)`, and covered panel exclusivity, draft retention, and desktop resizing. Those observations predate the current changes. The current focused checks above cover 390×844 and 844×390; 390×500 and the complete earlier preservation matrix have not been repeated. The captures `../visuals/B-fullheight-phone.png`, `../visuals/B-fullheight-short-phone.png`, and `../visuals/B-fullheight-landscape.png` document the earlier layout only.

### Resolved-controls iteration

The final focused validation used the shared working tree at `19755c750560723429555a9a92c55a554dbd6360` plus its uncommitted changes. In the ignored `.scratch/interface-revamp/preview-build` copy, `npm run typecheck` passed and `npm run build` completed successfully in 2m20s. The first sandboxed Nitro attempt failed with `EPERM` while resolving Vue's `index.mjs`; the final build was retried with the authorized local build environment and succeeded. The production preview from that exact build ran on `http://127.0.0.1:3131/`.

The Playwright QA command `node ..\device-preservation-lab\qa-resolved-tools.mjs` passed with 9 result cases. It checked both B control candidates at 390×844 and 844×390, all visible control hit targets, three explicit modes and one zoom group, toast clearance, mobile full-screen Inspect/Hierarchy exclusivity, Select click versus drag-pan on a system, repeated Add System and Add mark without automatic Inspect, invalid Add System feedback, right-drag and two-contact pan preserving a Jump Route origin, and Fields Escape closing before the unfinished Add action is canceled. There were no browser errors. The temporary-menu diagnostic `node .scratch/interface-revamp/device-preservation-lab/inspect-resolved-controls.mjs` passed for all Add and Map files actions, recording each menu rectangle, action rectangle, center hit test, trigger close, and restored control count in `.scratch/interface-revamp/device-preservation-lab/artifacts/resolved-tools-2026-10-15/layout-overlap-survey.json`. The full QA report and viewport screenshots are in the same artifact directory.

The short-landscape Dock Map files menu is now two columns. At 844×390 its bounds are `(431.8, 162.4)–(815.8, 249.2)`, ending above the Dock and zoom controls; all four action centers hit, and closing with the summary trigger restores all seven Dock/zoom controls. At 390×844 the one-column menu bounds are `(165.8, 144.2)–(373.8, 309.3)`; its four actions remain visible and hit-testable, and trigger-close restores the controls. Temporary Add-menu overlays were also measured: the Dock portrait menu `(59.0, 652.0)–(331.0, 744.8)` overlaps the zoom group while open, and the Dock landscape menu `(139.2, 172.8)–(347.2, 265.6)` crosses the Dock top by about 2.4 px. Both Add choices remain in viewport and center-hit-testable; closing with the Add trigger restores all seven Dock/zoom controls. The Groups Add menus have no measured overlap with their controls. These transient overlaps are recorded as open-menu states, not permanent layout occlusion.

This is viewport-emulated Chrome evidence. The two-contact route gesture was dispatched through CDP, not performed on physical hardware. The harness filters action buttons inside the closed Map files details element because those descendants retain measurable DOM rectangles while hidden; the summary trigger remains included and verified. This check does not cover 390×500, every menu action's application outcome, virtual keyboards, or physical touch behavior. SOL source review and the parent connected in-app-browser spot check on published commit `1666b008` are recorded separately in the [focused controls report](.scratch/interface-revamp/research/b-controls-prototype-2026-10-15.md).

### Selected Dock refinements

The subsequent [Dock feedback report](.scratch/interface-revamp/research/dock-feedback-2026-10-15.md) records targeted Orbit placement, adjacent panel/file commands and the anchored Nuxt UI Add chooser. The local production check at 1440×900, 390×844 and 844×390 passed repeated placement on rotated free-center and hosted Orbits, touch dismissal without placement, persistent Add and reachable HUD/status controls, with no page errors. That intermediate build predates the final chooser-layering correction.

The final two-file layering follow-up passes typecheck and independent SOL review. Focused local `npm run dev` checks pass at the same three sizes: both creation actions, header/close, seven catalogue families and their types remain visible and hit-testable over map chrome; stale Add-cancellation feedback does not cover the chooser, and closing preserves Add. The final source-linked screenshots include the development-only switcher. See [evidence and reproduction](.scratch/interface-revamp/device-preservation-lab/artifacts/dock-feedback-2026-10-15/README.md). This follow-up does not claim a fresh local production build or a complete replay of the earlier preservation suite. Vercel supplies the human's phone preview; physical-device and virtual-keyboard acceptance remain pending.
