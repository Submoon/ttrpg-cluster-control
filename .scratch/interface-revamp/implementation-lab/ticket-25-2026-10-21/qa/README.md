# Ticket 25 integrated QA

## Candidate and route

The intentionally continued feature baseline is `8d4b67841956e22e5b9d1269724845c902770121`, equal to the freshly fetched feature remote. `origin/main` remains `629d2a98715c3a16b954e0f77c639b1f0c31212c` (0 main-only, 49 feature-only before publication). The root coordinator owns the runtime, Git and evidence; implementation used Luna XHIGH and independent analysis/reviews used SOL 6.1 High.

`source-identity.json` pins 120 input files; `compiled-identity.json` pins all 814 built JavaScript/CSS files. The final suite uses the real persisted root application on the compiled production server. Only the existing test named `a failed IndexedDB save preserves current and backup snapshots` uses the development server because its established seam imports the Vite module. Tests use isolated Chromium/Chrome contexts, public controls, native map input and actual downloads/reload; the existing IndexedDB interception/read seam supplies durability failure evidence. User storage is untouched.

## Results

The final complete invocation passes **161/161 in 14.9 minutes**, with 0 failed, 0 skipped and 0 flaky tests. Of these, 160 run against compiled production on 3180 and the one established Vite-only storage test runs against development on 3100.

Final typecheck and production build pass. Original deadlines, one worker and zero retries are retained. `results.json` and `full-suite.log` are the authoritative complete run. Earlier targeted failures and their corrections are distinguished in the execution record rather than counted as blanket passes.

The compiled presentation preflight passes 1/1 in 14.5 seconds. Its real form flow verifies focus, portrait reflow, short-landscape bounds, finite geometry, canceled versus applied export data, Confirm and durable reload.

## Scope exercised

- Direct object drag-out to free placement; unique Orbit snapping, named ambiguity and invalid-only refusal; implicit source/destination occupant positions and following nested branches.
- Precise existing-object coordinates and Orbit angles, parent-owned preview/Confirm/Cancel, Add exclusivity, finite derived scene geometry and reload.
- Inspector Host choice, direct center attachment, independent radius minima, legacy implicit source/sibling radii and sibling reindex, small free-center movements.
- Every mode and Orbit-handle family through bounded orthogonal gesture cases: two contacts, native right pan/chord, Escape, tool changes, blur, touch cancellation and long press. Unfinished gestures cannot publish on late release; normal fresh operations remain usable.
- Failed save preserves applied attachment, the independent radius notice and unchanged durable current/backup records; Retry performs one new write and reload restores exact applied data.

## Presentation

The compiled product keeps the full board behind optional desktop overlay panels, compact context/header, bottom Dock and exclusive compact panels. New precision UI uses Nuxt UI popover/select/input/button primitives; D3 remains responsible for map geometry. The screenshots were exercised and visually inspected, not just captured:

- [Desktop light, 1440×960](workspace-desktop-light.png).
- [Portrait dark, 390×844](placement-portrait-dark.png).
- [Short landscape dark, 844×390](placement-landscape-dark.png).

`contrast-token-check.json` calculates the opaque token pairs used by the new form and existing controls: minimum useful-text ratio 5.51:1, minimum relevant border ratio 3.35:1; both themes exceed 4.5:1 text and 3:1 control thresholds. This is a scoped token check, not a whole-page accessibility audit. Public focus, names and non-drag alternatives are covered by the actual browser flows.

Physical Android Chrome, OS keyboard and safe-area proof remain unavailable. Full clean SVG/PNG acceptance remains ticket 28, which receives the transient-preview exclusion handoff. Whole-interface Astra review including Tools coherence, documentation consolidation and prototype disconnection remain ticket 29. No successor, source-issue closure or merge is performed.

The prior complete candidate had 158 passes / 3 failures. Its report, log and source identity are retained separately as predecessor evidence. The three legacy oracles were unchanged; after source corrections, all three and the adjacent Add-touch case passed together (4/4, 50.4 seconds). The final candidate adds reviewed stale-contact cleanup and passes the complete 161-case invocation. Source and compiled fingerprints were checked unchanged after QA. The screenshots above come from that final invocation and were visually inspected.

Archived text logs have trailing whitespace normalized for Git; their outcomes/content are unchanged and original TEMP logs remain intact.
