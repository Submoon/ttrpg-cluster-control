# Sequential implementation: tickets 18–21

## Authorization and fixed baseline

On 2026-10-16 the human explicitly requests implementation of local tickets 18, 19, 20 and 21 **in that order**, coordinated through subagents with a commit and push between tickets. The existing planning backlog is already committed/pushed as `3c660a6a2df6c37f392c998c36d72cec1ddbf938`; initial tracked worktree is clean. Unrelated untracked environment, diagnostic and runtime files remain outside this work.

Fresh origin fetch confirms that intentional feature base equals `origin/codex/interface-revamp`, 0 main-only / 24 feature-only against `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`. Source issue 3 is refreshed, unchanged and open. No source-issue comments/labels/closure or merge is requested. Each ticket's starting commit becomes its fixed review baseline; later tickets start only after the preceding ticket's required checks/reviews and commit/push.

Analysis/coordination uses SOL 6.1 High; delegated implementation uses Luna XHIGH. Use implement, TDD at the already human-confirmed actual-browser/codec/storage seams, and code-review's independent Standards and Spec axes. Sensitive data/recovery boundaries receive complementary review. Required contracts and evidence remain those of the unchanged specification and individual tickets; no hypothetical physical-device pass is inferred.

## Execution queue

| Ticket | State | Starting commit | Commit/push outcome |
| --- | --- | --- | --- |
| 18 — Open/recover the real local workspace | Closed: focused tests, typecheck, compiled QA and independent reviews pass | `3c660a6a2df6c37f392c998c36d72cec1ddbf938` | `006a245134ad06baaf0f56333d2722428b0df367` committed/pushed; local/remote equality confirmed |
| 19 — Theme/local resources | Closed: final source, reviews and affected compiled checks pass | `006a245134ad06baaf0f56333d2722428b0df367` | Final reviewed source `5b915a8d`; publication pending |
| 20 — Chart drafts/Apply/save recovery | Waiting for 19 | Pending | Pending |
| 21 — Maps/Dock/panels | Waiting for 20 | Pending | Pending |

## Validation and review record

Record actual per-ticket changes, command outcomes, frozen review identity, independent findings/corrections and remaining limits here as work executes. Development iteration uses local servers and isolated test browser contexts; compiled production is checked where needed for SSR/hydration/portal geometry. Run focused existing files during iteration and the full preservation suite at the end of the authorized sequence, with extra breadth only when failures or risk justify it. Existing default-route tests must exercise the actual persisted product, never the sample. Stop shared runtime writers before rebuilding or changing test fixtures.

### Ticket 18: independent review of the frozen candidate

Fixed comparison: `git diff 3c660a6a2df6c37f392c998c36d72cec1ddbf938...591745b8a6a39de85a10be1eb3c6e50b288b408f`; one unpublished candidate commit. This distinguishes the actual launch/recovery delta from earlier branch prototypes. [Implementation evidence](../implementation-lab/ticket-18/implementation-results.md) records the retained baseline, meaningful root-route red, 8/8 focused browser passes, typecheck and 44-test discovery. Compiled QA is separately pending.

#### Standards

Independent SOL 6.1 High review found no blocking technical defect or documented-standard violation. It inspected the actual diff, page/welcome callers, hydration/commit/restore transitions, storage implementation and all eight relevant test bodies. Two nonblocking observations remain: the abort test does not independently hold a successful request before successful transaction completion, and its local fault-hook type shape repeats. Source inspection confirms unchanged restoration awaits transaction completion; the abort case adds real UI and durable-record evidence. The coordinator retains the localized helper instead of introducing an abstraction for the repeated test-only shape. Neither observation changes the acceptance contract.

#### Spec

Independent SOL 6.1 High domain/data review found zero confirmed findings: no missing scoped persistence behavior, material scope creep or wrong implementation. Sole workspace ownership, current/backup identity and atomicity, ordinary memory-first save versus durable-first restore, and compatibility remain intact. Review was read-only; it does not independently certify reported runtime passes. Compiled responsive/contrast validation remains a completion gate. Light presentation belongs to 19; no physical Android Chrome pass is claimed.

Review totals: Standards — zero blocking findings, two nonblocking observations; Spec — zero findings, compiled verification pending separately.

### Ticket 18: compiled QA correction gate

The compiled build passes with normal filesystem access in 1m12s. A prior sandbox-only `EPERM` in Nitro realpath tracing is recorded as an environment failure, not a product compile defect. Fresh isolated Chromium checks of actual `/` pass creation, durable reload and recovery at 1440×900, 390×844, 844×390 and 390×500, without application page errors or hydration warnings.

Before-fix QA confirms four control-boundary contrast failures: both welcome inputs 1.917:1, recovery Try again 2.977:1 and Restore 2.988:1, against actual rendered adjacent backgrounds. Text passes 4.5:1 and focus color passes 3:1. At 844×390 both recovery buttons remain readable/activatable, but their bottom focus outline is clipped by approximately 5px. Viewport captures establish this separately from full-page screenshots. Luna's scope reopens only for the launch component and a focused regression; shared theme/data code remains untouched. No push or completion is allowed until the corrected compiled candidate passes. Before-fix evidence is retained under `implementation-lab/ticket-18/production-qa/before-fix/`.

The first repair fixes borders/recovery focus; upgrading the QA assertion from control bounds to the full computed outline reveals the same creation-action clipping. The coordinator reassesses the repair as one consistent launch-action rule. An explicitly exploratory isolated CSS injection proves the existing scroll margin also fixes creation; no acceptance pass is inferred from injection. Luna applies a semantic shared action class and extends the actual focus regression to cover Create and Restore. No further compaction or script-based coordinate adjustment is necessary.

### Ticket 18: final verification and handoff

Final source candidate `339a1062` receives independent follow-up Standards and Spec/domain-data reviews: zero blockers, no documented breaches, no domain/data findings. The remaining local fixture duplication and successful-transaction publication-order test limitation stay nonblocking; unchanged storage source explicitly awaits durable transaction completion. Review scope remains distinct from historical prototypes.

Current typecheck passes. Final normal-access production build passes in 1m45s. Strict compiled QA passes **41/41**, including complete visible focus outlines, actual-background contrast, SSR loading then hydration, isolated real creation/durable reload/recovery, keyboard/touch and four viewport sizes. Portable compiled launch/focus tests pass **2/2 in 4.7s**. Earlier focused recovery coverage remains **8/8**. Final application warnings/page errors are zero. Measured dark control-boundary minimum is **5.868:1**, text minimum **7.174:1**; positive viewport-only landscape captures were visually inspected by the coordinator. See [final results](../implementation-lab/ticket-18/production-qa/results.json).

Light presentation remains dependency 19 and physical Android Chrome checks remain unavailable. These results do not certify later editor workflows or the final cleaned bundle. Final source hashes in the QA manifest match the reviewed component/test snapshot; subsequent checkpoint edits are documentation/evidence/lifecycle only. Fresh fetch before publication still shows `origin/main = 629d2a98715c3a16b954e0f77c639b1f0c31212c`, no main-only commits, and the previous remote feature checkpoint `3c660a6a`. The completed checkpoint is pushed as `006a245134ad06baaf0f56333d2722428b0df367`, with local/remote equality verified before 19 is claimed.

### Ticket 19: bounded contract and implementation start

The [SOL contract](ticket-19-contract-2026-10-16.md) confirms the installed Nuxt UI integration already owns color-mode and icon modules. Reuse `UColorModeButton` and its OS-following/explicit localStorage preference; define shared semantic HTML/Nuxt UI/map palettes without another state owner, keyed remount or workspace save. Package Lucide locally and disable external collection/API fallback. Real Fields body portals and native controls remain within the palette scope; no artificial product menu or full-form redesign is added.

Luna XHIGH records the first real-root red on the healthy compiled ticket-18 baseline: no named Theme group/control is present. Scoped source ownership is header, common CSS, local resource/config/package files and a focused browser test; map style-only extensions require a demonstrated contrast need. An independent SOL QA agent prepares separate cold-server and cold-browser egress blocking, actual visible glyph inspection, composited contrast, SSR and mobile focus evidence while implementation owns the runtime. No ticket-19 pass is inferred from this preparation.

### Ticket 19: initial independent reviews and compiled correction gate

Fixed comparison: `git diff 006a245134ad06baaf0f56333d2722428b0df367...338fc1bc244b68b66818163dc219defb285591c7`. Standards finds no blocking defect or documented breach; the repeated pre-existing Local only badge is a nonblocking duplication judgment. Spec/domain-data finds no source-level missing or wrong implementation and no scope creep. Both distinguish the chart-draft test from the still-needed broader state and cold-resource evidence. The implementation owner will add representative object/route drafts and active Saving/Not saved checks; the independent QA supplies Orbit selection/camera and Fields validation-state checks.

The initial compiled build passes (2m33s), as do the two portable theme and two launch tests. Both separately labeled external-network canaries pass; normal application browser/server external attempts are zero. Twenty-two visible glyph checks show changed rendered pixels, and all 44 inspected local glyph names resolve actual SVG bodies. No application console/hydration warnings or page errors occur. These observations are not yet a completed ticket pass.

Compiled inspection confirms three repairable presentation defects: the new Theme group introduces created-editor overflow at 390px (529px document width, returning to 390px when that group alone is hidden in an explicitly diagnostic experiment); the landscape Fields trigger clips its full focus outline; and a native Fields select overrides focus with an alpha-0.12 outline while its border changes hue only. The initial welcome header does not overflow. One bounded correction batch will reflow the new group and restore semantic focus visibility without redesigning the ticket-21 shell or ticket-26 forms. Diagnostic injections are evidence of cause, never acceptance of a changed candidate.

Luna applies that bounded repair and extends the portable theme file to three cases. Typecheck and test discovery pass; no new dev-server startup is needed. The corrected unpublished candidate is `7fcf091b2c44af7b79708aff1a96aef9fcf1daa0`, still against fixed base `006a2451`. Follow-up Standards finds zero blockers/breaches and no new consequential smell; the previous badge-duplication judgment remains optional. The browser-platform hooks restore themselves in `finally`. Final compiled geometry/contrast and the five portable theme/launch cases remain the separate completion gate.

Follow-up Spec/domain-data also finds zero source findings or scope creep. It explicitly limits the save gate to deferred application-visible transaction notifications: IndexedDB may already be durable while the UI still says Saving. The separate settled-theme case supplies zero-write evidence. The corrected production build passes (1m48s), and all **five portable tests pass in 8.1s**. Cold resource/SSR/glyph checks, both-map contrast, Fields draft/error, camera and recovery checks pass; the introduced mobile overflow is repaired.

The Fields trigger focus ring still clips at the landscape viewport top. The coordinator visually verifies the screenshot and reassesses the design: a wrapped header without block padding has no space above its first row, and scroll margin cannot create scrollable space above the document. The next repair reserves semantic header block padding for every header command. It does not add coordinate offsets, force focus or expand into the later panel redesign. Sampling-only contrast ambiguities (finite CSS transitions and inner gap versus outer outline) are corrected separately and never counted as source failures. Unchanged cold-resource evidence remains valid; the padding-only candidate needs an affected production/header regression rather than another resource matrix.

### Ticket 19: final acceptance

Final reviewed source candidate `5b915a8de04afc06f7421587d53705b6338536ab` receives independent follow-up Standards and Spec reviews: zero blockers/breaches or domain/data findings. Optional duplication judgments remain the repeated Local only badge and the focused test's small geometry assertion; neither warrants an unrelated abstraction during this ticket. Typecheck passes. Final production build passes in 3m21s, **six portable tests pass in 20.6s**, and **98/98 affected product observations pass** across four viewports and both palettes. Header overflow, full Fields focus-ring bounds, native boundaries/focus and portal focus entry/return pass; minimum control/focus contrast is 3.7346:1. The coordinator inspected the clipped pre-repair viewport; QA inspects the final positive viewport evidence. Thirty-two Canvas performance hints originate in test-owned sampling and are retained/classified separately from zero application/hydration warnings or page errors.

The unchanged-resource cold matrix supplies actual local glyph/network evidence, both-map contrast, Fields draft/error, Orbit selection/camera and recovery. It is not silently relabeled as a cold run of the later padding change. No physical Android Chrome/OS keyboard/safe-area proof is available. Fresh origin fetch before publication still reports main `629d2a98`, remote feature `006a2451`, 0 main-only / 26 feature-only. Only ticket-owned source, planning and curated evidence enter this checkpoint; unrelated local diagnostic files remain preserved.
