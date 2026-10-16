# Inspector form prototype QA

This folder contains focused browser evidence for ticket 17's disposable B/Dock inspector prototype. The final run uses a compiled local production build and covers 11 focused scenarios. Detailed results, DOM measurements, downloaded JSON hashes, and source-manifest verification are in `qa-inspector-form.json`; the runnable Playwright harness is `qa-inspector-form.mjs`.

## Candidate and runtime

- Repository baseline: `8ff3d47a6e6bbfc957c7b3fec19ec856b49225ae`; `origin/main` at intake: `629d2a98715c3a16b954e0f77c639b1f0c31212c`.
- The isolated runtime is `.scratch/interface-revamp/preview-build`. Only the three frozen prototype files were copied there for the final candidate. Checkout and runtime SHA-256 values matched:
  - `components/PrototypeBInspector.vue`: `010D58FEDEED2780BEE57223E950B7BDD5D5233C2054DC20E18BAF7FCB24DF3E`
  - `components/PrototypeWorkbench.vue`: `B102BD8230E2D4E819D68B0B516DF9A3E39D34751AB8A3D9EA7CA090A6BB7D7D`
  - `components/prototype-inspector-fixture.ts`: `971DA11D6FE447B4CAF454FEAAB0954BD4CD4644B5A0E7E85D0DEC565CBE3CE5`
- The source manifest in the JSON report also compares legacy inspector, Fields UI, domain, codec, schema, and storage boundaries against the isolated runtime; each listed pair matches.
- Typecheck in `.scratch/interface-revamp/preview-build`: `& 'C:\nodejs\npm.cmd' run typecheck` — final candidate exit 0. The first candidate had a TypeScript TS2339 wiring error and was replaced before final validation.
- Production build in the same directory: `& 'C:\nodejs\npm.cmd' run build` — a default-sandbox attempt exited 1 at Nitro with `EPERM` while resolving `vue/index.mjs`; the identical command with `require_escalated` exited 0 (Nuxt 4.6.0 / Nitro 2.13.4). The production QA server was served at `http://127.0.0.1:3144/` (listener PID 2888, `node .output/server/index.mjs`).
- Final browser command from the repository root: `& 'C:\nodejs\node.exe' '.scratch/interface-revamp/device-preservation-lab/inspector-form-2026-10-16/qa-inspector-form.mjs'` with `require_escalated` — exit 0, 11 passed, 0 failed. Browser: Chrome 155.0.8059.41; Node: v24.18.1.

## Baseline capture limitation

The original development runtime on port 3139 did not become ready as an app. Screenshots named `baseline-*.png` show the Nuxt build-progress page and are environment evidence, not product-baseline captures. A process-check correction found that default-sandbox process and loopback checks had hidden a running Nuxt process; an elevated CIM check verified its command line. A local Nuxt lock was removed under the runtime procedure, but that alone did not establish that the process was stale or change application code. After an authorized restart of the exact identified process, the browser still showed Nuxt build progress. Final behavior and layout checks therefore ran against the compiled production runtime on port 3144.

## Executed scenarios

The final matrix covers desktop dense text and custom fields; 390×844 portrait, 844×390 landscape, and 390×500 reduced-height layout; hide/reopen, theme and resize draft retention; blank-name inline and summary feedback, `aria-invalid`/described-by linkage, and arrow-key containment; Apply/Discard and simulated save failure/Retry; applied-workspace JSON recovery export; route/system Apply and Orbit's read-only gate; Fields Stay/resume, Apply-object-draft/renewed-impact, and Discard-object-draft guard paths; and deletion review via Cancel, Escape, and confirmation.

Confirmed deletion reviewed `Aster (Planet, PL-1)` and its affected Orbit and Morrow moon before mutation. The final state retained unrelated entities. Both the dense applied-workspace export and ordinary post-deletion export decoded using the existing `prepareJsonImport` codec path with no reported ID collisions or possible matches. The dense export contains 3 systems, 13 objects, 6 orbits, 4 routes, and 7 custom fields; the post-deletion export contains 3 systems, 11 objects, 5 orbits, 4 routes, and 3 custom fields. The save-recovery case confirmed a dirty object draft was absent from the exported applied snapshot before Retry.

The final evidence images include:

- `qa-desktop-dense-inspector.png`
- `qa-inspector-portrait.png`
- `qa-inspector-landscape.png`
- `qa-inspector-compact.png`
- `qa-invalid-name-feedback.png`
- `qa-save-error-dense-applied.png`
- `qa-fields-renewed-impact-after-object-apply.png`
- `qa-delete-confirmed-result.png`

## Limits

All interactions used visible Playwright controls and keyboard input. `page.evaluate` was limited to read-only DOM inspection. The run did not inject app state. Responsive viewport emulation does not establish physical keyboard, touch, or safe-area hardware acceptance. The chart fallback was source-reviewed because the visible hierarchy flow did not expose a chart target. The prototype remains memory-only; these checks do not establish schema, durable-storage, or production-interchange changes.
