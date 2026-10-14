# Nuxt UI: compatibility and options for the revamp

Research conducted on **2026-10-13**, SOL 6.1 High. Ticket: [Evaluate Nuxt UI for the revamp without destabilizing map rendering](../tickets/02-nuxt-ui-fit.md). Map: [Revamp the interface: make the map central on desktop and mobile](../map.md).

**Finding: Nuxt UI is technically plausible for this repository’s interface. Its most direct value is in dialogs, menus, tooltips, and mobile panels. This research does not decide whether to adopt it.** Targeted adoption is the most useful hypothesis to compare with the current implementation in a prototype before a human decision. No product component, dependency, branch, or data was changed.

## Scope and method

External facts come only from official documentation and code consulted on the Web. Because Nuxt UI pages sometimes returned Markdown content that the Web tool could not read, its official releases and the code in the `nuxt/ui` repository’s `v4` branch served as additional primary sources. The branch is mutable: these findings describe the state consulted today, not a guarantee for a later installation.

The latest release shown on the [official releases page](https://ui.nuxt.com/docs/releases) is **4.11.3**, published on **October 1, 2026**; the [official package](https://github.com/nuxt/ui/blob/v4/package.json) also reports 4.11.3. Documented guarantees are distinguished from local observations and assumptions to verify. No comparative build or full accessibility audit was performed as part of this documentary research.

## Observed repository state

Targeted baseline revalidation on 2026-10-13: inspected local `main` is at `629d2a98715c3a16b954e0f77c639b1f0c31212c`. The latest fetch during the interaction decision session confirms `HEAD == origin/main`, with zero commits ahead/behind and no tracked-tree difference; the earlier divergence is no longer current. Product identity uses TTRPG Cluster Control branding, database/JSON markers, and native drag MIME types; the V1 effort lives under `.scratch/ttrpg-cluster-control/`. Merged corrections add Orbit host-minimum clamping with independent feedback and validated snapshots with last-valid backup recovery. These behaviors must survive any UI-library integration. Relevant versions, SSR/client boundaries, Tailwind registration, dialog behavior, map theme tokens, and export pipeline are unchanged. This update does not repeat external research or decide Nuxt UI adoption.

| Local item consulted | Observation and implication |
| --- | --- |
| [package.json](../../../package.json), [package-lock.json](../../../package-lock.json) | Resolved versions: Nuxt 4.6.0, Vue 3.5.43, Tailwind and its Vite plugin 4.3.3, D3 7.9.0. TypeScript declared as `^6.0.3`. Nuxt UI is absent. |
| [nuxt.config.ts](../../../nuxt.config.ts) | SSR is active; Tailwind is added manually to the Vite pipeline. The page title is TTRPG Cluster Control. A Nitro/Windows workaround already exists; future integration must be validated in this environment. |
| [main.css](../../../assets/css/main.css) | Fixed dark palette in `:root`, `color-scheme: dark`, separate `--app-*` / controls / `--map-*` variables. Global button, field, and focus styles; no theme control in the inspected files. |
| [MapEditorLayout.vue](../../../components/MapEditorLayout.vue) | Persistent Vue panels using `v-show`, transitions, and shared state. At 760 px, only one panel remains open; the inspector closes after mounting. Some surfaces still use fixed RGBA colors. |
| [FieldDefinitionsDialog.vue](../../../components/FieldDefinitionsDialog.vue) | Native teleported `<dialog>`, `showModal()`, ARIA title, intercepted Escape, and focus returned to the trigger. Confirmation before discarding a draft and reset after a successful save are already implemented. There is therefore a functional foundation to preserve. |
| [WorkspaceHeader.vue](../../../components/WorkspaceHeader.vue) | The visible brand and accessible home link use TTRPG Cluster Control. File actions use a custom dropdown group, with Escape and focus return; JSON/PNG/SVG buttons, errors, and file import. Replacing it with a menu requires preserving its business behavior. |
| [pages/index.vue](../../../pages/index.vue), [SystemMap.vue](../../../components/SystemMap.vue), [ClusterMap.vue](../../../components/ClusterMap.vue) | Maps are under `ClientOnly`; Vue owns the interface and D3 the SVG scene and its gestures. SVG styles use `--map-*`. |
| [map-image-export.ts](../../../utils/map-image-export.ts) | Export clones the SVG, copies computed styles, removes the viewport transform and editing handles, serializes the SVG, then rasterizes it to Canvas for PNG. It exports the resolved colors of the mounted scene. |

## Compatibility and integration

The [official Nuxt UI module](https://github.com/nuxt/ui/blob/v4/src/module.ts) requires Nuxt `>=4.1.0`, adds `@tailwindcss/vite` itself, configures `@nuxt/icon`, and enables fonts and color mode by default, with options to disable them. Its [package](https://github.com/nuxt/ui/blob/v4/package.json) accepts Tailwind `^4` and TypeScript `^5.6.3 || ^6 || ^7`; its Node engine requires `^20.19.0 || >=22.12.0`. The [official development catalog](https://github.com/nuxt/ui/blob/v4/pnpm-workspace.yaml) uses Tailwind 4.3.3 and Vue 3.5.43, matching the local lockfile. This establishes generation compatibility, not that installation in this application will succeed.

**Proposed integration consequence:** if Nuxt UI is selected, add the module and the `@nuxt/ui` CSS import, then remove the manual Vite addition of Tailwind to avoid registering the same plugin twice. Tailwind and Nuxt UI CSS imports are shown on the [official site](https://ui.nuxt.com/). Plan for the `UApp` provider: its [official code](https://github.com/nuxt/ui/blob/v4/src/runtime/components/App.vue) provides Reka configuration, tooltips, overlays, and a `body` portal. Disable automatic fonts if the local font stack is to remain. The CSS layer order and global field/focus selectors should be checked visually; custom rules may combine with component classes.

[Reka UI documents SSR for its primitives](https://reka-ui.com/docs/guides/server-side-rendering), with a caveat about identifiers for Vue versions earlier than 3.5; the local version is above that threshold. Nuxt’s [`ClientOnly` code](https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/components/client-only.ts) keeps child rendering until after mounting. **Architectural inference:** the Nuxt UI wrapper can remain SSR while D3/SVG stays within its existing client boundary. Wrapping the entire page in `ClientOnly` is not necessary to adopt controls. Verify the first render, fallback size, teleports, ARIA identifiers, and the absence of hydration warnings.

Tailwind 4’s foundation targets at least Chrome 111, Safari 16.4, and Firefox 128 according to its [compatibility documentation](https://tailwindcss.com/docs/compatibility). This is already a repository constraint; Nuxt UI does not establish compatibility with every older mobile browser.

## Interface, map, and export themes

Nuxt UI has semantic colors, themes by slot/variant, and global overrides in `app.config.ts` or local overrides through `ui`. Its [official CSS variables](https://github.com/nuxt/ui/blob/v4/src/runtime/index.css) separate text, background, and border and redefine them in `.dark`; the file also defines the Tailwind `.light`/`.dark` variants. Customization is therefore possible without abandoning the chosen visual direction. [Overview of the theme system](https://ui.nuxt.com/).

An application token layer could feed both Nuxt UI variables and map-specific variables. **Proposal for a decision:** share a few palette primitives while keeping explicit SVG roles for routes, orbits, selection, background, labels, and halos. A button accent and a route line do not necessarily have the same contrast requirements. The fixed RGBA colors on existing panels must also join the theme contract. `color-scheme` helps native controls but does not recolor those fixed values.

Color Mode distinguishes mutable `preference` from resolved `value`; its [options](https://color-mode.nuxtjs.org/usage/configuration) offer local storage, session storage, or cookies, with a `system` default and `light` fallback. Its [documented usage](https://color-mode.nuxtjs.org/usage/basic) supports an explicit light/dark control and a shared HTML class. These library defaults do not decide the product’s initial OS preference. The [official SSR caveats](https://color-mode.nuxtjs.org/advanced/caveats) call for `unknown` or `ColorScheme` for template paths that depend on a mode detected client-side. Test reloading with a saved preference and the first display of labels/icons.

**Essential distinction:** Nuxt UI does not configure the D3 renderer, create the export, or guarantee a readable PNG/SVG. Today, the export clone takes computed colors from the displayed theme. A light export for printing would require an explicit palette and export rendering; that choice remains open. Temporarily recoloring the page to export could disrupt the view and should not be assumed necessary. Test exported files in a separate viewer without the application’s CSS, including modern fonts/colors after rasterization. The future **player export** and its data policy remain in their separate issue: the current removal of handles is not a privacy mechanism.

## Dialogs, panels, and compact controls

| Need | Documentation basis and implication for the revamp |
| --- | --- |
| Field definitions dialog | `UModal` is built on Reka Dialog and exposes controlled state, title, description, closing, and fullscreen in its [official code](https://github.com/nuxt/ui/blob/v4/src/runtime/components/Modal.vue). [Reka Dialog](https://reka-ui.com/docs/components/dialog) documents modal focus trapping, Escape, and return to the trigger. Preserve the existing dialog’s confirmations, errors, and drafts; specify initial focus and closing during save. |
| Inspector / mobile hierarchy | [Slideover](https://github.com/nuxt/ui/blob/v4/src/runtime/components/Slideover.vue) uses Dialog and is modal with an overlay by default. [Drawer](https://github.com/nuxt/ui/blob/v4/src/runtime/components/Drawer.vue) uses **vaul-vue**, with bottom direction, handle, modality, and closing enabled by default; it passes through snap points and `handleOnly`. Do not confuse this Drawer with Reka’s Alpha Drawer in its documentation. |
| Keep the map visible during editing | A modal panel makes the content underneath inert: while it is open, the map cannot receive commands. To switch between values and the map, compare a persistent/non-modal panel with a modal drawer. Nuxt UI does not decide this contract. The [Sidebar introduced in 4.6](https://ui.nuxt.com/docs/releases/v4.6.0) also supports conversion to a mobile overlay; its navigation focus does not require replacing specialized panels. |
| Retain state on close | Since [4.10.0](https://ui.nuxt.com/docs/releases/v4.10.0), Modal and Slideover offer `unmountOnHide: false`. This can help with drafts and scroll position. Do not assume this option for Drawer; keep important state in the parent and test mounting, closing, and selection changes. |
| File actions | [Reka DropdownMenu](https://reka-ui.com/docs/components/dropdown-menu) handles focus, arrow keys, activation, and Escape. It may help with compact actions, but rich content with notes, alerts, or fields may fit a popover better than an action menu. Choose semantics based on the final content. |
| Icon buttons and help | [Reka Tooltip](https://reka-ui.com/docs/components/tooltip) opens on focus or hover and closes on activation or Escape. A tooltip alone does not ensure that a command’s name is available on touch. Keep explicit accessible names and help that can be consulted on mobile; validate how the icons are understood in the prototype. |

These mechanisms reduce plumbing work; they do not prove the application is accessible. Check keyboard opening/closing, Tab/Shift+Tab, return to the trigger, menus inside a dialog, no focus behind an overlay, and scroll restoration. On mobile, check the virtual keyboard, long scrolling, safe areas, and conflicts between Drawer swipes and map panning. Choose a handle or close button that does not require a precise gesture.

For a WCAG 2.2 AA target to confirm in the specification: [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) sets 24 × 24 CSS pixels with exceptions; that is not the same as a comfortable target for everyone. [2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires an alternative to dragging that can be performed with a single pointer, subject to an exception; keyboard alone does not satisfy this criterion. [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) sets, among other things, 3:1 for visual information needed to identify controls and graphical objects. Contrast for light/dark themes, selection, and map focus still needs to be measured separately.

## Icons, licensing, and maintenance

Nuxt UI v4 unifies UI and the former Pro; all its components are announced as freely available in the [4.0.0 release](https://ui.nuxt.com/docs/releases/v4.0.0). The [current official license](https://github.com/nuxt/ui/blob/v4/LICENSE.md) is MIT: use, modification, and distribution are permitted with retention of the copyright and permission notice, and without warranty. There is therefore no need to budget for a Pro license based on older articles.

Icons are provided through `@nuxt/icon`. The [4.10.0 release](https://ui.nuxt.com/docs/releases/v4.10.0) documents pre-bundling internal icons when the collection is installed locally, with Lucide as the default. For the local product, verify the selected icons after network disconnection and also bundle icons whose names are dynamic. This behavior does not remove the need to check network resources in the final build.

The [official Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE) is ISC, with an MIT section for icons derived from Feather; retain the corresponding notices. For another Iconify collection, check its own license. Free Nuxt UI code does not automatically grant a universal license for fonts, collections, trademarks, or external resources.

The release cadence is observable; the [4.11.3 fixes](https://ui.nuxt.com/docs/releases) still include component ARIA labels and forms before hydration. This supports tracking versions, pinning a version, and checking updates; it proves neither general instability nor freedom from future defects. The library adds an external contract of props/slots/themes to maintain, while keeping the existing implementation leaves those behaviors to the repository.

## Comparison of options

The qualitative assessments below describe likely work based on the local code and APIs consulted, without estimates in days or kilobytes.

| Option | Potential value | Specific cost / risk | Condition for choosing |
| --- | --- | --- | --- |
| Broad adoption of Nuxt UI for the wrapper and controls | Consistent variants, forms, overlays, menus, and tools; shared primitives for future changes. | Migration of many surfaces and styles; regression of business states and appearance; broader dependencies. Does not replace D3/SVG/export. | Choose if the prototype shows an overall benefit and the migration can preserve all recorded behavior. |
| Targeted adoption for Modal, Slideover/Drawer, menus, tooltip, and a few buttons | Tests gains where focus, stacking, and mobile behavior are most costly; keeps the views/maps and business forms. | Two styles/APIs temporarily; a theme bridge to build; module, provider, CSS, and dependency cost even for a few components. | Recommended as a hypothesis for a comparative trial, subject to a human decision to adopt. |
| Keep the current Vue/CSS components | Continuity of the data model, events, and exports; design freedom, no new UI library. | The repository must maintain focus, stacking, closing, mobile adaptation, themes, touch help, and regression checks itself. The current native dialog already reduces some of this cost. | Viable if required interactions remain simple and accessibility/mobile validation is funded. |

The package contains many dependency families: its npm list does not represent the JavaScript transferred to this page. The [4.10.0 optimizations](https://ui.nuxt.com/docs/releases/v4.10.0) mention tree-shaking; [component detection in 4.1.0](https://ui.nuxt.com/docs/releases/v4.1.0) is still experimental and limits CSS to components in use and their dependencies. No universal bundle-size figure can be applied here. Dynamic imports and computed icon names may require an explicit inventory.

The [unstyled mode in 4.9.0](https://ui.nuxt.com/docs/releases/v4.9.0) also removes structural classes: layout and transitions shift to the repository. It is therefore not an automatic saving for Drawer/Modal. It can be evaluated if the chosen design strongly conflicts with the default theme, without multiplying approaches at the outset.

## Unknowns to resolve before commitment

1. **Future minimal trial:** a mobile panel with real content, the field definitions dialog, the file group, and a theme control around an existing D3 map. Check a selection and a draft across opening, closing, and viewport changes. No prototype is included in this research.
2. **Comparable measurements:** same map and data, production build before/after; initial JS and deferred chunks, CSS, icons/fonts, mount time, overlay opening, and cost during pan/zoom. Measure on a modest mobile device and desktop, including with the network disconnected. Do not invent a performance budget before this measurement.
3. **SSR and colors:** first render and reload after a saved preference; hydration console; no disruptive shift in panels/map; UI/SVG themes and SVG/PNG exports in another viewer. Also verify modern computed styles through Canvas.
4. **Accessibility validation:** keyboard and screen reader with real titles, focus in nested overlays, touch and virtual keyboard, alternative to drag, target sizes, and contrast. Global conformance requires the real user journey, not just an accessible library.
5. **Next human decision:** choose keep / targeted adoption / broad adoption, as well as panel behavior and visual direction. The factual research can be closed; the decision remains open and belongs in its HITL ticket.

## Research conclusion

The repository’s versions are within Nuxt UI’s current range. Targeted adoption may bring tangible value to wrapper interactions without touching the model or D3 engine; this is an experimental recommendation, not a decision to adopt. The exact cost, touch quality, and state preservation must be demonstrated with real content. Whichever library is chosen, UI/SVG/export policy, panel behavior, and accessibility guarantees remain application work.
