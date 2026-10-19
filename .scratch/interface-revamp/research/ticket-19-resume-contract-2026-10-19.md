# Ticket 19 resumed contract — 2026-10-19

## Authority and evidence boundary

The human resumes only [local ticket 19](../tickets/19-theme-and-local-resources.md), after ticket 18. This specialist follows the project-development architecture assignment without rerouting or spawning agents. Documentation is English. No application/test changes, runtime, browser, build, Git or network writes were performed for this contract.

Coordinator-confirmed freshly fetched baseline: `f64d00dbaf9cee569a8a62db0005b4ffe7f00ca7`, equal to `origin/codex/interface-revamp`; intentionally above `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only / 36 feature-only). Source issue 3 remains unchanged/open according to the coordinator. Specification stories 103–111 and crosscutting 82, 89–90, 119–120 apply; B4/B9 are the public acceptance families.

The [fidelity reset](interface-fidelity-reset-2026-10-16.md) withdraws earlier acceptance, not useful implementation. The [original contract](ticket-19-contract-2026-10-16.md) and historical ticket-19 QA are prior art only. No historical 98/405 matrix total is a current pass. Ticket 18's bounded launch/recovery acceptance is retained; its whole-suite result is 0 passed / 1 failed / 92 not run, with `tests/cluster-map.spec.ts:78` failing to find the restored `Open Vesper system map` node. Cause is unclassified; do not call it pre-existing or perform a broad map repair here.

## Current implementation and actual gaps

| Source observation | Decision |
| --- | --- |
| `app.vue` contains one `UApp`; `pages/index.vue` selects the persisted product at `/`. | Retain both. Prototype routes cannot supply product acceptance. |
| `nuxt.config.ts` already explicitly configures system-first color mode, light fallback, bare HTML classes, `nuxt-color-mode` localStorage, disabled transitions; installed Nuxt UI's `UColorModeButton` assigns explicit light/dark preferences. | Retain the existing owner and initialization script. No new provider, preference composable, watcher or storage adapter. Fresh execution must establish current behavior. |
| `assets/css/main.css` defines light/dark semantic, map, native-control and Nuxt UI aliases; both D3 maps consume map variables. Fields and Map files use shared tokens. | Reuse the palette. Only actual rendered contrast/focus failures justify local token/style corrections. No renderer rebuild. |
| `WorkspaceHeader.vue` now has a generic theme `div` with `aria-label="Theme controls"`; the established `role=group`, name `Theme` seam used by `tests/workspace-theme.spec.ts` is absent. | Concrete source-backed semantic regression to reproduce first. Restore a named Theme group around the existing Nuxt UI control. Keep the meaningful switch-action button name. |
| Existing `.theme-control*` classes in `main.css` provide an explicit boundary/focus treatment, but Header now uses `.workspace-header-theme*` and an unconfigured ghost `UColorModeButton`. Header also references undefined `--panel`. | These are inspection leads, not measured contrast failures. Reuse button props/classes and existing semantic tokens for a demonstrated defect; do not treat unused CSS or the unrelated header layout as permission for redesign. |
| `nuxt.config.ts` already bundles local Lucide with `remote:false`, server provider and `fallbackToApi:false`; package/lock already contain `@iconify-json/lucide`. | No reinstall or resource rewrite is indicated. Prove cold rendering under fresh browser AND server guards. |
| Existing theme tests contain OS/explicit choice, chart/object/route drafts, zero workspace writes and saving/failure checks. Historical QA contains pixel glyph, actual-background contrast and guard helpers. | Reuse their mechanisms with current public selectors and new evidence identities. Do not rerun the historical exhaustive script unchanged. |

Loaded-map top Dock, fixed columns/overlays and dense header remain ticket 21. Ticket 19 must preserve their current interactions while repairing only its theme/resource seams; it cannot certify whole-map fidelity. For any changed surface, compare the actual integration with B/Dock's applicable structure and record the difference. A small semantic/style repair to the theme group does not authorize restructuring the whole header.

## Implementation boundary and invariants

Primary source ownership: `components/WorkspaceHeader.vue`; `assets/css/main.css` only when a measured theme-control/shared-token defect needs it. Own `tests/workspace-theme.spec.ts` for focused public-seam regressions and new ticket-19-resume QA/evidence under `implementation-lab/ticket-19-resume-2026-10-19/`. Preserve historical evidence files; copy/extract reusable helper functions rather than overwriting old results.

Conditional source ownership must be justified by a reproduced ticket-19 defect before editing: `assets/css/map-workspace.css`, map component **styles only**, `nuxt.config.ts`, `app.config.ts`, `package.json`/lock. Configuration/package changes currently have no demonstrated need. Do not touch domain, codec/schema, persistence/workflow, editor state, prototype, Dock/layout implementation or unrelated forms. Do not add a durable draft, migration, global state/theme engine, app test API or separate component harness.

Preserve the six pre-existing modified files byte-for-byte against `implementation-lab/ticket-18-resume-2026-10-19/preserved-working-tree.json`: `tests/cluster-map.spec.ts`, `tests/helpers.ts`, `tests/object-fields.spec.ts`, `tests/workspace-chart-drafts.spec.ts`, `tests/workspace-data.spec.ts`, `tests/workspace-ui.spec.ts`. Do not stage them or change shared helpers to make theme checks pass.

- HTML color mode remains the single product owner; OS changes apply only before explicit choice. The initial stored `system` value is not an explicit choice. Browser storage refusal may prevent persistence but must leave editing usable and must not become a workspace-save error.
- Explicit preference survives reload and a fresh isolated context carrying that browser's saved storage, plus workspace creation/import. Preference never enters workspace JSON or IndexedDB workspace records.
- Theme activation changes no committed workspace data, placement, selection, view/camera, tool, draft identity/content/validation errors or save/recovery state. It neither remounts editors nor starts a workspace mutation/save.
- Inspect actual `current`/`last-valid` records AND count workspace write operations in a settled theme-only interval. Equal records alone do not prove no writes. Existing delayed-save instrumentation holds event notification delivery; it does not prove durability was physically suspended.
- Apply latest-memory validation, scoped Cancel, durable backup restoration and truthful recovery retain existing owners and guarantees. Theme repair introduces no new path through them.
- Preserve `WorkspaceWelcome.vue` and its ticket-18 opaque local focus correction/scroll margins; do not reintroduce a global translucent Nuxt UI focus token over it.
- Useful text needs >=4.5:1 and meaningful graphics/control boundaries/focus >=3:1 against actual adjacent/composited backgrounds. Preserve non-color selection/unknown-route/error cues, keyboard names and unobscured outlines. Decorative grids/shadows and disabled controls must be classified honestly.

## Smallest vertical RED/green

1. Use the already approved public browser seam at `/`: fresh OS-light context, actual Welcome, `getByRole('group', { name: 'Theme', exact: true })`, named switch button and native HTML color scheme. Run this narrow case before editing; record whether failure is the expected absent group. A setup/runtime failure is not a product RED.
2. Restore only semantic grouping around `UColorModeButton`; reuse its props/attrs/classes before any bespoke button. Run the same case to GREEN, including keyboard activation and focus. Do not manufacture RED for the retained preference/icon implementation.
3. Inspect actual focus/text/button contrast in light/dark. If a real defect appears, add the smallest behavioral assertion, capture that failure, apply one local token/control correction, rerun it. Avoid speculative palette changes or a test that merely mirrors class names.

Current theme tests may also contain selectors from earlier composition. If a selector is stale, adapt only the owned test to the actual named public command without weakening the user outcome; classify that harness correction separately from source defects. If a journey exposes an unrelated loaded-map failure, record the exact blocker and stop that journey rather than silently repairing ticket 21.

## Bounded validation plan

One runtime owner; serialize browser/build operations. Run focused development checks while implementing, then typecheck, **one** whole repository run with one worker and `--max-failures=1`, **one final build**, and the bounded compiled checks below. A source correction after the final build invalidates it and requires an explicitly explained replacement build; avoid exploratory rebuilds. Do not repeatedly run the full suite or broaden into unrelated historical failures.

Focused development: the owned theme file (four existing cases) plus only an individually selected launch/focus regression relevant to changed source. Retain representative object/route/chart draft and pending/failed save journeys already present; extend the same file only to close a real coverage gap. Full-suite first-failure stop is a preservation signal, not authority for a broad repair. If the known cluster-return failure repeats, retain its actual context and report the suite limitation accurately.

Compiled acceptance is a compact set of journeys, not a theme × viewport × form matrix:

| Journey | Required observations |
| --- | --- |
| Desktop 1440×900, fresh OS-light then OS-dark, explicit choice and opposite OS | SSR response contains the real loading shell; coherent hydrated HTML/native palette without product warnings; named control, keyboard focus, preference reload/fresh-session persistence. Capture the changed Theme surface. |
| One validated rich workspace, desktop toggles both palettes | Both actual maps, meaningful route/selected/unresolved cues, Orbit selection/camera/tool, one Fields draft with validation feedback, native input/select, Fields/Map files portal palette and focus entry/return; compare retained state and zero settled workspace writes. Reuse focused test evidence for object/route/chart/save details instead of duplicating every journey. |
| 390×844 touch, 844×390 keyboard/touch, 390×500 reduced height | Each performs actual theme activation and a relevant portal open/close with reachable controls, no horizontal overflow and complete unobscured focus; collectively observe both palettes. Preserve Welcome/recovery focus where applicable. Do not duplicate every draft in every viewport. |
| Cold compiled icon/resource journey | Fresh guarded server/browser, inventory current used static/dynamic icon names, obtain local SVG bodies, and inspect rendered pixels/paths/masks for actual mounted controls including both dynamically selected theme glyphs. No warm cache or status-only pass. |

Measure a small explicit sample in each palette: changed theme control's text/boundary/focus, native control, portal text/control, map label and meaningful selected/unresolved graphic against rendered backgrounds. Use existing QA screenshot/compositing helpers, recording each real sample and its threshold. Samples cannot certify every possible workspace state or overall B/Dock fidelity. Capture the changed surface and representative portal/mobile outcomes, not another whole historical screenshot matrix.

## Practical external-network denial and cold proof

Reuse the historical `production-qa/network-guard.cjs` as a **test-owned preload in the actual new compiled Node process** (`node --require <guard> .output/server/index.mjs`), with a new `QA_NETWORK_GUARD_LOG` and loopback listener. Its socket/TLS/DNS hooks and synchronized built-in ESM exports deny non-loopback hostnames/IPs while allowing loopback and local pipes. Require the same process's separately labeled outbound `example.com:443` canary to record denial before product requests. A guard running only in the QA driver is insufficient. Record PID, command, build/source identity and guard-installed/canary records.

Launch a new browser process, empty isolated context, service workers blocked, HTTP cache cold; abort all non-loopback browser HTTP(S) requests through context routing before navigation. Run a separate context navigation/fetch to an external canary URL, require a logged abort/failure, then use a new clean product context. Keep intentional canaries separate from ordinary app attempts. Compiled product currently needs HTTP icon resources, not external websockets; if any websocket is observed, explicitly deny it with Playwright's websocket routing before claiming complete resource denial.

With both guards active, verify loopback `/` still responds and hydrates, then mount real theme/portal controls. Inventory current application and Nuxt UI default/configured names, including runtime-selected names; request uncached local `/api/_nuxt_icon/lucide.json` names and inspect actual SVG body geometry. For real rendered dynamic sun/moon and any newly mounted local icon, record visible dimensions, SVG path or mask content and a bounded glyph-pixel check (historical helper available). Distinguish collection-body coverage from actually visible glyph coverage. Neither browser-only blocking nor package/config inspection proves cold offline rendering.

The Node guard covers the compiled Nuxt application's JavaScript networking path; it is not a machine firewall or protection against arbitrary native add-ons/subprocesses. Record this limit without inventing OS-level blocking. Fresh-process identities, empty context, guard canaries, actual glyph evidence and no unexpected external attempts are the required practical proof.

## Completion and handoff

Freeze an exact candidate diff/file-hash snapshot for independent technical and domain/data reviews. Record focused RED/GREEN, typecheck, sole full-suite result, final build and bounded compiled outcomes with source/runtime/fixture identities, browser, viewport/input, observed/unexecuted/failed/unavailable distinctions and cleanup. Preserve hashes of the six unrelated files. No source-issue closure or unrelated ticket claim follows.

Physical Android Chrome, real OS keyboard, safe-area and physical gesture checks remain unavailable unless actually performed. Emulation supplies no physical pass. A remaining unclassified full-suite failure prevents a repository-wide preservation claim; the coordinator must report that limit separately from any satisfied ticket-19 scoped outcomes. The next action is the minimal semantic RED/GREEN above, followed by bounded fresh verification of retained behavior, not a speculative rewrite.
