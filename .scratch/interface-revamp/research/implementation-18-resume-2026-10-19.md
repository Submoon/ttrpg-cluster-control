# Ticket 18 resumption - 2026-10-19

## Authority, baseline and ownership

The human explicitly resumes implement for local ticket 18 only, requiring the corrected instructions and appropriate fidelity to the accepted B/Dock prototype. Analysis is SOL 6.1 High; implementation is Luna XHIGH; the coordinator owns planning/Git and independent reviews. Browser public seams and mobile emulation were already human-confirmed. Do not resume tickets 19–29.

Fresh origin fetch: feature HEAD/remote 28278d90c462fcc0542088513ebd8cf07c7eeaa4; origin/main629d2a98715c3a16b954e0f77c639b1f0c31212c; intentional 0 main-only/33 feature-only. Source issue3 is read unchanged/open, with no comments. The six pre-existing uncommitted test edits are hashed in ../implementation-lab/ticket-18-resume-2026-10-19/preserved-working-tree.json and remain outside this ticket's changes.

## Scope and acceptance boundary

Ticket18 covers root creation/loading/resume and honest recovery. The existing storage/domain behavior is retained unless a scoped defect is demonstrated. Use the applicable B visual language and NuxtUI for changed launch surfaces. The prototype contains seeded maps rather than an empty/loading/recovery flow; compare shared identity, hierarchy, palette and density without inventing a prototype form. Map Dock/desktop overlays/header correction remains21; no whole-editor fidelity pass follows from18.

## Validation plan

One runtime owner. Capture before/after launch and recovery and applicable B reference at desktop and compact viewports. Use existing launch/recovery Playwright seams for create/reload, inaccessible/corrupt current record, missing/damaged backup and failed/successful durable-first restore. Add only meaningful public-interface regressions, red before green where changed behavior needs coverage. Typecheck, build, one full-suite invocation at the end and independent Standards/Spec reviews. Record baseline-known failures separately; do not weaken or expand into unrelated map repair to manufacture green. No physical Android Chrome proof is available.

## Frozen change and scoped results

Initial source candidate: `86b5ab64fcaf0e477faabe25fd8ccaf0030e88cf`, compared with fixed base `28278d90c462fcc0542088513ebd8cf07c7eeaa4`. Application changes are confined to `components/WorkspaceWelcome.vue`; the only test changes strengthen two viewport assertions in the existing launch/recovery journeys. Native forms, names, required fields, 80-character limits, models/events and the single persistence owner are preserved. No header, map, storage, schema, package or global-theme source changed.

The developer reports 9/9 focused development tests and a passing typecheck. The independently owned final build passes in 1m17s with unchanged source hashes. Actual compiled launch/recovery files pass 8/8 in 10.6s; the ninth test uses a development-module import and remains covered by the development run rather than being misrepresented as portable compiled coverage. See the [developer handoff](../implementation-lab/ticket-18-resume-2026-10-19/developer/handoff.md) and [final QA record](../implementation-lab/ticket-18-resume-2026-10-19/qa/final-summary.md).

The coordinator visually inspected the four after captures plus the two short-height before captures. The compact Nuxt UI cards and controls preserve the applicable B hierarchy and palette; Create and the recovery actions fit the demonstrated short viewports. B has no matching empty/loading/recovery fixture. Its contextual capture was taken before its map mounted and is not map-fidelity evidence. The accepted loaded-map reference and its corrective obligations remain unchanged for ticket 21.

### Standards review

Independent SOL 6.1 High source review of the frozen candidate reports **zero documented-standard breaches and zero consequential heuristic findings; no blocker**. It verifies English documentation, the explicit baseline, cohesive presentation ownership, native label/input forwarding, submission and disabled behavior. It does not independently certify runtime, contrast or hydration.

### Spec/domain-data review

A second independent SOL 6.1 High source review reports **zero confirmed missing/partial scoped requirements, scope-creep findings or wrong implementations; no blocker**. It verifies the single workspace owner, no editable partial workspace, memory-first creation and durable-before-publication backup restoration. Runtime and device outcomes remain separately owned QA evidence.

### Whole-suite limitation

Exactly one full development-suite attempt discovers 93 tests: **0 passed, 1 failed, 92 not run**, stopping at the configured first failure. At `tests/cluster-map.spec.ts:78`, the restored cluster-node locator is absent; the saved error context shows the Vesper system map after the requested cluster-return sequence. The precise cause is **unclassified**, not demonstrated pre-existing. Map source and the six preserved test/helper files were unchanged by this candidate; this does not prove causality. No repeat, test weakening or unrelated map repair is used to manufacture a pass. This run does not establish whole-product preservation or acceptance of ticket 21.

That whole-suite attempt uses the preserved local test/helper working tree identified in `preserved-working-tree.json`. Those six pre-existing edits are deliberately excluded from this ticket's commits; the result is not represented as a clean-HEAD reproduction. Application source and the scoped launch/recovery test identities are separately frozen and reviewed.

The earlier withdrawn closures remain historical evidence, not this resumption's acceptance. Physical Android Chrome keyboard/safe-area/gesture validation is unavailable; emulation does not replace it.

### Independent compiled focus finding and correction

The initial presentation helper first stopped on a fixture/setup mistake: valid default names let its Create click open a workspace before it checked required-name validation. That harness mistake is corrected by explicitly emptying both names; it is not a product RED.

The corrected helper then demonstrates a real scoped failure: Nuxt UI's 25%-alpha light focus outline composites to **1.4566:1** against the rendered launch panel, below the required 3:1. Text and control boundaries pass. The coordinator confirms this finding and sends one bounded correction to the original Luna owner: use the existing opaque focus token locally on Welcome inputs/actions through supported component styling, without global/theme/domain changes. Source reviews and compiled affected checks must verify the corrected candidate before closure. The initial 8/8 compiled result above does not conceal this presentation failure.

The bounded correction is committed as `06997ef73fe9f722f458f491b50dafab32d9c6a7` on the initial candidate. It adds five scoped CSS lines setting `outline-color: var(--focus) !important` for the changed launch inputs/actions and recovery actions. This local priority is justified by the confirmed utility-color cascade; it preserves Nuxt UI controls, geometry, native focus-visible behavior and the existing light/dark tokens. Final component SHA-256: `c9d9209bbaea340b2080e9f2441afd19adf87d37e99749667bcf163ca2a05707`. No TypeScript, behavior, global theme or persistence changes follow the reported typecheck. The necessary corrected build passes in 1m38s, followed by **8/8** compiled launch/recovery tests in 9.6s; the full suite is not repeated. Both independent reviewers verify this correction against the actual hash and report no new findings; compiled contrast remains separately verified by QA.

The final input-focus sampler initially encountered Chrome's selected-text background after keyboard Tab. Its ordinary-text foreground calculation was invalid against that selected pixel; no product contrast failure follows from this mismatched state. The helper clears the selection using ArrowRight and waits for the short color transition before sampling the same controls at unchanged thresholds. This is a measurement correction, with the failed helper attempt retained separately.

The source issue is re-read before completion on 2026-10-19: still open, unchanged, with no comments. No source-issue write or closure is requested or inferred.

## Final scoped acceptance

The corrected compiled presentation run passes **100/100 bounded assertions** over four viewports in both themes, with zero application/hydration console warnings and zero page errors. These are presentation observations, not 100 independent user journeys or a whole-editor test suite. Sampled minima are text **5.7401:1**, controls **5.5869:1**, focus **6.1266:1** on actual rendered backgrounds. The coordinator also inspects the final dark-desktop Welcome and light-short-landscape recovery PNGs: actions and focus remain visible, errors stay actionable, and the restrained changed surfaces respect the applicable reference language.

Ticket 18 is closed for its launch/recovery scope only. Ticket 19 becomes open/unclaimed; 20–29 remain blocked. No further implementation starts from this request. Final QA records source/compiled identity, curated evidence and verified runtime cleanup; the six pre-existing test files are preserved byte-for-byte and excluded from staging. Source and documentation commits use the existing feature branch, with the existing PR retained as a draft because the larger interface remains incomplete.

## Baseline evidence and first meaningful RED

The initial restricted process produced watcher/socket errors before browser checks; those are environment failures, not product REDs. The directly tracked authorized development server warms successfully after a 2m21s cold bundle. Browser checks use installed Chrome in isolated contexts, without the human's storage/profile.

Four retained-baseline captures and one B reference are saved before application edits. Actual root responses are 200 with no page errors. The coordinator visually inspects short-landscape welcome and reduced-height recovery: the Create action and recovery actions are clipped at their lower edges. The first full-visibility assertion fails on the unchanged welcome at 844×390 with viewport ratio 0.6933. A partial-intersection assertion was insufficient and is not counted as a RED. This is a concrete responsive presentation gap; the first correction stays within WorkspaceWelcome. Recovery is a separate second slice, not a bulk imagined test suite.
